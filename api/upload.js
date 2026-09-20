// api/upload.js — Upload e gerenciamento de documentos com Cloudflare R2 e compatibilidade legada Vercel Blob
import { put, del, issueSignedToken, presignUrl } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canWriteData, canDeleteData, canAccessModule, permissionError } from './_permissions.js';
import { createTenantSql } from './_tenant-sql.js';
import { putR2Object, deleteR2Object, buildR2ObjectKey } from './_edge-r2.js';
import { createRuntimeSql } from './_database.js';

function getSql() {
  return createRuntimeSql();
}


function getPrivateBlobOptions() {
  const options = {};
  const token = String(process.env.FINOBRA_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  const storeId = String(process.env.FINOBRA_BLOB_STORE_ID || '').trim();
  if (token) options.token = token;
  if (storeId) options.storeId = storeId;
  return options;
}

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '22mb'
    }
  }
};

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
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
  const sql = createTenantSql(getSql(), { tenantId });
  if (req.method === 'GET' && !canAccessModule(auth,'documentos','read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN','documentos'));
  if (req.method === 'POST' && !canAccessModule(auth,'documentos','write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','documentos'));
  if (req.method === 'DELETE' && !canAccessModule(auth,'documentos','delete')) return res.status(403).json(permissionError('MODULE_DELETE_FORBIDDEN','documentos'));
  if (req.method === 'POST' && !canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));
  if (req.method === 'DELETE' && !canDeleteData(auth)) return res.status(403).json(permissionError('ROLE_DELETE_FORBIDDEN'));
  const r2Ready = Boolean(req.env?.ATTACHMENTS_R2 && typeof req.env.ATTACHMENTS_R2.put === 'function');
  const allowLegacyBlobUpload = String(process.env.FINOBRA_ALLOW_LEGACY_BLOB_UPLOAD || '').trim().toLowerCase() === 'true';
  const privateBlobReady = Boolean(String(process.env.FINOBRA_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim() || String(process.env.FINOBRA_BLOB_STORE_ID || '').trim());
  const configuredAccess = String(process.env.FINOBRA_BLOB_ACCESS || process.env.BLOB_ACCESS || (privateBlobReady ? 'private' : 'public')).trim().toLowerCase();

  if (!r2Ready && !allowLegacyBlobUpload && req.method === 'POST') {
    return res.status(503).json({
      success: false,
      code: 'R2_STORAGE_REQUIRED',
      error: 'Cloudflare R2 indisponível. Novos uploads estão bloqueados para impedir fallback acidental para armazenamento legado.'
    });
  }

  if (!r2Ready && configuredAccess === 'private' && !privateBlobReady && req.method === 'POST') {
    return res.status(500).json({
      success: false,
      error: 'Armazenamento privado seguro não está pronto no servidor. Upload bloqueado por segurança (fail-closed).'
    });
  }
  const blobAccess = configuredAccess === 'private' && privateBlobReady ? 'private' : 'public';

  // ── GET: URL temporária para leitura de documento privado ───────────────────
  if (req.method === 'GET') {
    try {
      const documentId = String(req.query?.document_id || req.query?.id || '').trim();
      if (!documentId) return res.status(400).json({ success: false, error: 'ID do documento é obrigatório.' });

      const rows = await sql`SELECT id, url, nome_arquivo, tipo_arquivo FROM documentos WHERE id = ${documentId} AND tenant_id = ${tenantId} LIMIT 1;`;
      if (!rows.length || !rows[0].url) {
        return res.status(404).json({ success: false, error: 'Arquivo não encontrado para este tenant.' });
      }

      const blobUrl = String(rows[0].url);
      if (blobUrl.startsWith('r2://')) {
        const key = blobUrl.slice('r2://'.length);
        const expectedPrefix = `tenants/${tenantId}/`;
        if (!key.startsWith(expectedPrefix) && !auth.isSystem) {
          return res.status(403).json({ success:false, error:'Arquivo não pertence ao tenant autenticado.' });
        }
        return res.status(200).json({
          success: true,
          url: `/api/v2/edge/storage/file/${encodeURIComponent(key)}`,
          private: true,
          storage: 'cloudflare_r2',
          filename: rows[0].nome_arquivo || '',
          contentType: rows[0].tipo_arquivo || 'application/octet-stream'
        });
      }

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
            if (String(url).startsWith('r2://')) {
              const cleanPath = String(url).slice('r2://'.length);
              isCanonicalTenantBlob = cleanPath.startsWith(`tenants/${tenantId}/`);
            } else {
              const parsedUrl = new URL(url);
              const cleanPath = parsedUrl.pathname.replace(/^\/+/, '');
              isCanonicalTenantBlob = cleanPath.startsWith(`${tenantId}/`) || cleanPath.startsWith(`tenants/${tenantId}/`);
            }
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

      // 2. Exclusão no armazenamento persistente
      if (finalUrl && String(finalUrl).startsWith('r2://')) {
        const key = String(finalUrl).slice('r2://'.length);
        const expectedPrefix = `tenants/${tenantId}/`;
        if (!key.startsWith(expectedPrefix) && !auth.isSystem) {
          return res.status(403).json({ success:false, error:'Arquivo não pertence ao tenant autenticado.' });
        }
        await deleteR2Object(req.env || {}, key);
      } else if (finalUrl && finalUrl.includes('blob.vercel-storage.com')) {
        // Compatibilidade de leitura/exclusão para objetos legados durante a migração.
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
      return res.status(500).json({ success: false, error: 'Não foi possível excluir o arquivo.' });
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
      if (r2Ready) {
        return res.status(409).json({
          success: false,
          code: 'R2_DIRECT_UPLOAD_ONLY',
          error: 'O FinGo usa Cloudflare R2. Envie o arquivo pelo fluxo autenticado do aplicativo.'
        });
      }
      if (blobAccess === 'private') {
        return res.status(409).json({
          success: false,
          code: 'PRIVATE_BLOB_DIRECT_UPLOAD_ONLY',
          error: 'Upload privado deve usar o fluxo autenticado do FinGo.'
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
              'image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
              'application/acad', 'application/x-acad', 'image/vnd.dwg', 'image/vnd.dxf',
              'application/x-step', 'model/ifc', 'model/obj', 'model/gltf+json', 'model/gltf-binary',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain', 'text/csv', 'application/xml', 'text/xml'
            ],
            maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB
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
      'csv', 'doc', 'docx', 'txt', 'dwg', 'dxf', 'ifc', 'obj', 'gltf', 'glb', 'zip', 'rar', '7z'
    ];
    const ALLOWED_MIMES = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/xml', 'text/xml', 'text/plain', 'text/csv',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-ofx', 'application/ofx',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/acad', 'application/x-acad', 'image/vnd.dwg', 'image/vnd.dxf',
      'application/x-step', 'model/ifc', 'model/obj', 'model/gltf+json', 'model/gltf-binary', 'application/json'
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

    if (disallowedExts.includes(lowerExt) || disallowedMimes.includes(cleanMime) || !ALLOWED_EXTENSIONS.includes(lowerExt)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de arquivo não permitido por políticas de segurança do FinGo.'
      });
    }

    // Fail-early check por tamanho da string base64 antes de alocar buffer em memória
    const approxBytes = Math.ceil(cleanBase64.length * 0.75);
    const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
    if (approxBytes > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        success: false,
        error: 'Arquivo excede o limite máximo permitido de 15 MB.'
      });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        success: false,
        error: 'Arquivo excede o limite máximo permitido de 15 MB.'
      });
    }

    // ── PATCH 50: Validação cruzada extensão × MIME × magic bytes ───────────────
    // Leitura prévia dos magic bytes (primeiros 12 bytes) antes da tabela
    const magicHex = buffer.slice(0, 12).toString('hex').toUpperCase();
    // Bloquear imediatamente executáveis e scripts (PE, ELF, HTML, shebang)
    const isExeOrScript = magicHex.startsWith('4D5A') || magicHex.startsWith('7F454C46')
      || buffer.slice(0, 30).toString('utf8').toLowerCase().includes('<html')
      || buffer.slice(0, 10).toString('utf8').startsWith('#!/');
    if (isExeOrScript) {
      return res.status(400).json({
        success: false,
        error: 'Assinatura binária do arquivo rejeitada (contém conteúdo executável ou script).'
      });
    }

    // Tabela declarativa: cada extensão tem um MIME canônico esperado e um prefixo binário.
    // textOnly = true: arquivos de texto puro sem magic bytes fixos;
    //                  verificamos apenas que não são binários executáveis/markup.
    const MIME_MAGIC_TABLE = [
      { exts: ['pdf'],         mime: ['application/pdf'],                                                   magic: ['25504446'] },          // %PDF
      { exts: ['png'],         mime: ['image/png'],                                                         magic: ['89504E47'] },          // PNG
      { exts: ['jpg','jpeg'],  mime: ['image/jpeg'],                                                        magic: ['FFD8FF'] },            // JPEG SOI
      // PATCH 50.1: WEBP = RIFF nos bytes 0-3 + 'WEBP' nos bytes 8-11.
      // Verificar apenas RIFF permitiria AVI, WAV e outros RIFF mascarados como .webp.
      { exts: ['webp'], mime: ['image/webp'],
        magicValidator: (buf) =>
          buf.slice(0,4).toString('hex').toUpperCase() === '52494646' &&
          buf.slice(8,12).toString('ascii') === 'WEBP'
      },
      { exts: ['zip'],         mime: ['application/zip','application/x-zip-compressed'],                    magic: ['504B0304','504B0506','504B0708'] },
      { exts: ['xlsx'],        mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: ['504B0304'] },          // OOXML = ZIP
      { exts: ['docx'],        mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: ['504B0304'] },
      { exts: ['xls'],         mime: ['application/vnd.ms-excel'],                                         magic: ['D0CF11E0'] },          // OLE2
      { exts: ['doc'],         mime: ['application/msword'],                                                magic: ['D0CF11E0'] },
      { exts: ['dwg'],         mime: ['application/acad','application/x-acad','image/vnd.dwg'],             magic: ['41433130','41433131','41433132','41433133','41433134','41433135'] }, // AC10-AC15+
      { exts: ['glb'],         mime: ['model/gltf-binary'],                                                 magic: ['676C5446'] },          // glTF
      { exts: ['rar'],         mime: ['application/x-rar-compressed'],                                     magic: ['526172211A07'] },      // Rar!..
      { exts: ['7z'],          mime: ['application/x-7z-compressed'],                                      magic: ['377ABCAF271C'] },      // 7z
      // Texto puro: sem magic bytes fixos — verificação mínima de não-executável
      { exts: ['txt','csv','xml','ofx','qfx','dxf'], textOnly: true,
        mime: ['text/plain','text/csv','application/xml','text/xml','application/x-ofx','application/ofx','image/vnd.dxf'] },
      { exts: ['ifc'], textOnly: true,
        mime: ['text/plain','application/x-step','model/ifc'] },
      { exts: ['obj'], textOnly: true,
        mime: ['text/plain','model/obj'] },
      { exts: ['gltf'], textOnly: true,
        mime: ['application/json','text/plain','model/gltf+json'] },
    ];

    // Encontrar a entrada da tabela pelo lowerExt
    const mimeEntry = MIME_MAGIC_TABLE.find(e => e.exts.includes(lowerExt));
    if (!mimeEntry) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de arquivo não permitido por políticas de segurança do FinGo.'
      });
    }

    // Verificar MIME declarado contra os MIMEs canônicos da extensão
    const mimeAllowed = mimeEntry.mime
      ? (mimeEntry.mime.includes(cleanMime) || cleanMime === 'application/octet-stream')
      : true;
    if (!mimeAllowed) {
      return res.status(400).json({
        success: false,
        error: `MIME "${cleanMime}" não é compatível com a extensão ".${lowerExt}".`
      });
    }

    if (lowerExt === 'ifc') {
      const headText = buffer.slice(0, Math.min(buffer.length, 1024 * 1024)).toString('utf8');
      if (!/ISO-10303-21/i.test(headText) || !/IFCPROJECT/i.test(headText)) {
        return res.status(400).json({ success: false, error: 'Arquivo IFC inválido ou incompleto.' });
      }
    } else if (lowerExt === 'obj') {
      const headText = buffer.slice(0, Math.min(buffer.length, 1024 * 1024)).toString('utf8');
      if (!/^v\s+/m.test(headText) || !/^f\s+/m.test(headText)) {
        return res.status(400).json({ success: false, error: 'Arquivo OBJ inválido: vértices/faces não encontrados.' });
      }
    } else if (lowerExt === 'gltf') {
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        if (!parsed?.asset?.version) throw new Error('asset.version ausente');
      } catch {
        return res.status(400).json({ success: false, error: 'Arquivo GLTF inválido.' });
      }
    }

    // Verificar magic bytes: suporta prefixo hex (magic[]) ou validador completo (magicValidator).
    if (mimeEntry.magicValidator) {
      // Validador customizado recebe o buffer completo (ex.: WEBP precisa checar bytes 8-11)
      if (!mimeEntry.magicValidator(buffer)) {
        return res.status(400).json({
          success: false,
          error: 'Conteúdo binário do arquivo não corresponde à extensão declarada. Upload rejeitado por segurança.'
        });
      }
    } else if (mimeEntry.magic) {
      const magicMatch = mimeEntry.magic.some(prefix => magicHex.startsWith(prefix));
      if (!magicMatch) {
        return res.status(400).json({
          success: false,
          error: 'Conteúdo binário do arquivo não corresponde à extensão declarada. Upload rejeitado por segurança.'
        });
      }
    }

    // Para arquivos de texto puro: apenas garantir que não são PE/ELF/HTML
    // (isExeOrScript já foi verificado acima, antes deste bloco)

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (r2Ready) {
      const objectKey = buildR2ObjectKey(tenantId, 'documentos', safeFilename);
      const stored = await putR2Object(req.env, objectKey, buffer, {
        contentType: cleanMime,
        customMetadata: {
          tenantId,
          category: 'documentos',
          originalName: filename
        }
      });
      return res.status(200).json({
        success: true,
        url: `r2://${stored.key}`,
        pathname: stored.key,
        size: stored.size,
        contentType: cleanMime,
        access: 'private',
        storage: 'cloudflare_r2'
      });
    }

    // Upload legado somente quando explicitamente habilitado para migração/compatibilidade controlada.
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
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
      access: blobAccess,
      storage: 'vercel_blob_legacy'
    });

  } catch (err) {
    console.error('[Blob] Erro no upload:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao processar upload no armazenamento seguro.'
    });
  }
}
