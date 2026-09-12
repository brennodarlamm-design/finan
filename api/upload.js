// api/upload.js — Endpoint Serverless para Upload e Gerenciamento no Vercel Blob
import { put, del, issueSignedToken, presignUrl } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canWriteData, canDeleteData, canAccessModule, permissionError } from './_permissions.js';

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }
  return neon(conn);
}


function getPrivateBlobOptions() {
  const options = {};
  const token = String(process.env.FINOBRA_BLOB_READ_WRITE_TOKEN || '').trim();
  const storeId = String(process.env.FINOBRA_BLOB_STORE_ID || '').trim();
  if (token) options.token = token;
  if (storeId) options.storeId = storeId;
  return options;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
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

  const tenantId = auth.tenantId;
  if (req.method === 'GET' && !canAccessModule(auth,'documentos','read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN','documentos'));
  if (req.method === 'POST' && !canAccessModule(auth,'documentos','write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','documentos'));
  if (req.method === 'DELETE' && !canAccessModule(auth,'documentos','delete')) return res.status(403).json(permissionError('MODULE_DELETE_FORBIDDEN','documentos'));
  if (req.method === 'POST' && !canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));
  if (req.method === 'DELETE' && !canDeleteData(auth)) return res.status(403).json(permissionError('ROLE_DELETE_FORBIDDEN'));
  const privateBlobReady = Boolean(String(process.env.FINOBRA_BLOB_READ_WRITE_TOKEN || '').trim() || String(process.env.FINOBRA_BLOB_STORE_ID || '').trim());
  const configuredAccess = String(process.env.FINOBRA_BLOB_ACCESS || process.env.BLOB_ACCESS || (privateBlobReady ? 'private' : 'public')).trim().toLowerCase();
  
  if (configuredAccess === 'private' && !privateBlobReady && req.method === 'POST') {
    return res.status(500).json({
      success: false,
      error: 'Armazenamento privado seguro não está pronto no servidor (FINOBRA_BLOB_READ_WRITE_TOKEN pendente). Upload bloqueado por segurança (fail-closed).'
    });
  }
  const blobAccess = configuredAccess === 'private' && privateBlobReady ? 'private' : 'public';

  // ── GET: URL temporária para leitura de documento privado ───────────────────
  if (req.method === 'GET') {
    try {
      const documentId = String(req.query?.document_id || req.query?.id || '').trim();
      if (!documentId) return res.status(400).json({ success: false, error: 'ID do documento é obrigatório.' });

      const sql = getSql();
      const rows = await sql`SELECT id, url, nome_arquivo, tipo_arquivo FROM documentos WHERE id = ${documentId} AND tenant_id = ${tenantId} LIMIT 1;`;
      if (!rows.length || !rows[0].url) {
        return res.status(404).json({ success: false, error: 'Arquivo não encontrado para este tenant.' });
      }

      const blobUrl = String(rows[0].url);
      const isPrivate = blobUrl.includes('.private.blob.vercel-storage.com');
      if (!isPrivate) {
        return res.status(200).json({ success: true, url: blobUrl, private: false });
      }

      let pathname = '';
      try { pathname = new URL(blobUrl).pathname.replace(/^\/+/, ''); } catch {}
      if (!pathname) return res.status(422).json({ success: false, error: 'Caminho do arquivo privado inválido.' });

      const delegationUntil = Date.now() + 15 * 60 * 1000;
      const urlUntil = Date.now() + 10 * 60 * 1000;
      const signedToken = await issueSignedToken({
        ...getPrivateBlobOptions(),
        pathname,
        operations: ['get'],
        validUntil: delegationUntil
      });
      const { presignedUrl } = await presignUrl(signedToken, {
        pathname,
        operation: 'get',
        access: 'private',
        validUntil: urlUntil
      });

      return res.status(200).json({
        success: true,
        url: presignedUrl,
        private: true,
        expires_in_seconds: 600,
        filename: rows[0].nome_arquivo || '',
        contentType: rows[0].tipo_arquivo || 'application/octet-stream'
      });
    } catch (err) {
      console.error('[Blob] Erro ao gerar URL privada:', err);
      return res.status(500).json({ success: false, error: 'Não foi possível liberar o arquivo para leitura.' });
    }
  }

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
        // H-17: Validação estrita e canônica de pathname no Blob, sem fallback frágil de substring
        let isCanonicalTenantBlob = false;
        try {
          if (url) {
            const parsedUrl = new URL(url);
            const cleanPath = parsedUrl.pathname.replace(/^\/+/, '');
            // O caminho deve iniciar estritamente com "<tenantId>/"
            isCanonicalTenantBlob = cleanPath.startsWith(`${tenantId}/`) || cleanPath.startsWith(`tenants/${tenantId}/`);
          }
        } catch {
          isCanonicalTenantBlob = false;
        }

        if (!isCanonicalTenantBlob && !auth.isSystem) {
          return res.status(403).json({
            success: false,
            error: 'Permissão negada. O arquivo não pertence ao seu tenant ou não foi localizado.'
          });
        }
      }

      // 2. Exclusão no Vercel Blob
      if (finalUrl && finalUrl.includes('blob.vercel-storage.com')) {
        const deleteOptions = finalUrl.includes('.private.blob.vercel-storage.com') ? getPrivateBlobOptions() : undefined;
        await del(finalUrl, deleteOptions);
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
    // A. Suporte a Client-side Upload token (@vercel/blob/client handleUpload).
    // O fluxo legado é mantido apenas para store público. Em modo privado, o app atual
    // usa upload server-side para não gerar acidentalmente um token de store público.
    if (req.body && req.body.type === 'blob.generate-client-token') {
      if (blobAccess === 'private') {
        return res.status(409).json({
          success: false,
          code: 'PRIVATE_BLOB_DIRECT_UPLOAD_ONLY',
          error: 'Upload privado deve usar o fluxo autenticado do FinObra.'
        });
      }
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
      ? contentType.split(';')[0].toLowerCase().trim()
      : (contentType || 'application/octet-stream').toLowerCase().trim();

    const ALLOWED_EXTENSIONS = [
      'pdf', 'png', 'jpg', 'jpeg', 'webp', 'ofx', 'qfx', 'xml', 'xlsx', 'xls',
      'csv', 'doc', 'docx', 'txt', 'dwg', 'dxf', 'zip', 'rar', '7z'
    ];
    const ALLOWED_MIMES = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/xml', 'text/xml', 'text/plain', 'text/csv',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-ofx', 'application/ofx',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/acad', 'application/x-acad', 'image/vnd.dwg', 'image/vnd.dxf',
      'application/octet-stream'
    ];

    const lowerExt = (filename.includes('.') ? filename.split('.').pop() : '').toLowerCase();
    const parts = filename.split('.');
    if (parts.length > 2) {
      const suspiciousExts = ['exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'scr', 'php', 'py', 'html', 'htm', 'jar'];
      if (parts.some((p, idx) => idx < parts.length - 1 && suspiciousExts.includes(p.toLowerCase()))) {
        return res.status(400).json({
          success: false,
          error: 'Nome de arquivo suspeito contendo extensão executável oculta.'
        });
      }
    }

    const disallowedExts = ['html', 'htm', 'svg', 'xhtml', 'exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'scr', 'php', 'py'];
    const disallowedMimes = ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'application/x-msdownload', 'text/javascript', 'application/javascript'];

    if (disallowedExts.includes(lowerExt) || disallowedMimes.includes(cleanMime) || !ALLOWED_EXTENSIONS.includes(lowerExt) || !ALLOWED_MIMES.includes(cleanMime)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de arquivo não permitido por políticas de segurança do FinObra.'
      });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        success: false,
        error: 'Arquivo excede o limite máximo permitido de 15 MB.'
      });
    }

    // Estrutura de pastas no Blob: <tenantId>/documentos/<ano>/<mes>/<timestamp>_<filename>
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `${tenantId}/documentos/${ano}/${mes}/${Date.now()}_${safeFilename}`;

    const blob = await put(pathname, buffer, {
      ...(blobAccess === 'private' ? getPrivateBlobOptions() : {}),
      access: blobAccess,
      contentType: cleanMime
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: buffer.length,
      contentType: blob.contentType,
      access: blobAccess
    });

  } catch (err) {
    console.error('[Blob] Erro no upload:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao processar upload no Vercel Blob: ' + err.message
    });
  }
}
