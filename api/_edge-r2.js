// api/_edge-r2.js — Camada de Armazenamento de Arquivos no Cloudflare R2 (Zero Egress)
// Suporta plantas, fotos de canteiro, XMLs de notas fiscais e relatórios com isolamento multi-tenant.

const memoryStorage = new Map();

/**
 * Gera caminho canônico e seguro no bucket R2 com isolamento multi-tenant.
 */
export function buildR2ObjectKey(tenantId, category, filename) {
  const rawTenant = String(tenantId || '').trim();
  const normTenant = rawTenant.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!rawTenant || !normTenant) {
    throw new Error('tenantId válido é obrigatório para gerar chave no R2.');
  }
  const normCat = String(category || 'docs').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'docs';
  const cleanName = String(filename || 'arquivo.bin').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `tenants/${normTenant}/${normCat}/${timestamp}_${rand}_${cleanName}`;
}

/**
 * Faz upload de um arquivo para o Cloudflare R2 (ou armazenamento de fallback).
 */
export async function putR2Object(env, key, data, options = {}) {
  if (!key || !data) throw new Error('Chave e dados são obrigatórios para upload no R2.');
  const { contentType = 'application/octet-stream', customMetadata = {} } = options;

  if (env && env.ATTACHMENTS_R2 && typeof env.ATTACHMENTS_R2.put === 'function') {
    try {
      const obj = await env.ATTACHMENTS_R2.put(key, data, {
        httpMetadata: {
          contentType
        },
        customMetadata: {
          ...customMetadata,
          uploadedAt: new Date().toISOString()
        }
      });
      return {
        key: obj.key,
        size: obj.size,
        etag: obj.etag,
        httpMetadata: obj.httpMetadata,
        storage: 'cloudflare_r2'
      };
    } catch (err) {
      console.error('[FinGo Edge R2] Falha no upload persistente:', err?.message || err);
      throw new Error('Falha ao gravar o arquivo no armazenamento Cloudflare R2.');
    }
  }

  if (String(env?.FINOBRA_ALLOW_MEMORY_STORAGE || '') !== 'true') {
    throw new Error('Binding ATTACHMENTS_R2 indisponível. Upload bloqueado para evitar persistência volátil.');
  }

  const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : Buffer.from(data);
  memoryStorage.set(key, {
    data: buffer,
    contentType,
    customMetadata,
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString()
  });

  return {
    key,
    size: buffer.byteLength,
    storage: 'memory_test_fallback',
    contentType
  };
}

/**
 * Obtém um arquivo do Cloudflare R2.
 */
export async function getR2Object(env, key) {
  if (!key) return null;

  if (env && env.ATTACHMENTS_R2 && typeof env.ATTACHMENTS_R2.get === 'function') {
    try {
      const obj = await env.ATTACHMENTS_R2.get(key);
      if (obj) {
        return {
          body: obj.body,
          size: obj.size,
          contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
          customMetadata: obj.customMetadata,
          storage: 'cloudflare_r2'
        };
      }
    } catch (err) {
      console.error('[FinGo Edge R2] Falha ao recuperar objeto persistente:', err?.message || err);
      throw new Error('Falha ao consultar o armazenamento Cloudflare R2.');
    }
  }

  if (String(env?.FINOBRA_ALLOW_MEMORY_STORAGE || '') !== 'true') return null;

  const item = memoryStorage.get(key);
  if (item) {
    return {
      body: item.data,
      size: item.size,
      contentType: item.contentType,
      customMetadata: item.customMetadata,
      storage: 'memory_fallback'
    };
  }

  return null;
}

/**
 * Remove um arquivo do Cloudflare R2.
 */
export async function deleteR2Object(env, key) {
  if (!key) return false;

  if (env && env.ATTACHMENTS_R2 && typeof env.ATTACHMENTS_R2.delete === 'function') {
    try {
      await env.ATTACHMENTS_R2.delete(key);
      return true;
    } catch (err) {
      console.error('[FinGo Edge R2] Falha ao excluir objeto persistente:', err?.message || err);
      throw new Error('Falha ao excluir o arquivo no armazenamento Cloudflare R2.');
    }
  }
  if (String(env?.FINOBRA_ALLOW_MEMORY_STORAGE || '') === 'true') {
    memoryStorage.delete(key);
    return true;
  }
  throw new Error('Binding ATTACHMENTS_R2 indisponível. Exclusão não executada.');
}

/**
 * Lista objetos no R2 por prefixo de tenant.
 */
export async function listR2Objects(env, prefix = '', limit = 50) {
  if (env && env.ATTACHMENTS_R2 && typeof env.ATTACHMENTS_R2.list === 'function') {
    try {
      const result = await env.ATTACHMENTS_R2.list({ prefix, limit });
      return {
        objects: result.objects.map(o => ({
          key: o.key,
          size: o.size,
          uploaded: o.uploaded,
          contentType: o.httpMetadata?.contentType
        })),
        truncated: result.truncated
      };
    } catch (err) {
      console.error('[FinGo Edge R2] Falha ao listar armazenamento persistente:', err?.message || err);
      throw new Error('Falha ao listar arquivos no armazenamento Cloudflare R2.');
    }
  }

  if (String(env?.FINOBRA_ALLOW_MEMORY_STORAGE || '') !== 'true') {
    throw new Error('Binding ATTACHMENTS_R2 indisponível. Listagem bloqueada.');
  }

  // Fallback exclusivo de testes
  const list = [];
  for (const [k, v] of memoryStorage.entries()) {
    if (k.startsWith(prefix)) {
      list.push({
        key: k,
        size: v.size,
        uploaded: v.uploadedAt,
        contentType: v.contentType
      });
      if (list.length >= limit) break;
    }
  }

  return { objects: list, truncated: false };
}
