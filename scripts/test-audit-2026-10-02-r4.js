// scripts/test-audit-2026-10-02-r4.js
// Regressões da quarta rodada da auditoria de 02/10/2026 (U1–U5).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (4ª rodada) — regressões ===\n');

// U1 — Documentos não podem apontar para arquivo de outra empresa.
{
  const { isTenantStorageUrl } = await import('../api/_edge-r2.js');
  assert.strictEqual(isTenantStorageUrl('r2://tenants/acme/docs/a.pdf', 'acme'), true);
  assert.strictEqual(isTenantStorageUrl('r2://tenants/outra/docs/a.pdf', 'acme'), false);
  assert.strictEqual(isTenantStorageUrl('https://x.private.blob.vercel-storage.com/acme/documentos/2026/09/1_a.pdf', 'acme'), true);
  assert.strictEqual(isTenantStorageUrl('https://x.private.blob.vercel-storage.com/outra/documentos/2026/09/1_a.pdf', 'acme'), false);
  assert.strictEqual(isTenantStorageUrl('https://x.public.blob.vercel-storage.com/acme/../outra/a.pdf', 'acme'), false);
  assert.strictEqual(isTenantStorageUrl('https://x.blob.vercel-storage.com/acmeX/a.pdf', 'acme'), false, 'prefixo exige barra');
  assert.strictEqual(isTenantStorageUrl('', 'acme'), true, 'sem arquivo');
  assert.strictEqual(isTenantStorageUrl('https://exemplo.com.br/manual.pdf', 'acme'), true, 'link externo não é armazenamento da plataforma');

  const { handleSave } = await import('../api/_db-mutations.js');
  let queries = 0;
  const sql = () => { queries++; return Promise.resolve([]); };
  let status = 200; let body;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; }, setHeader() {} };
  await handleSave(sql, 'acme', { tenantId: 'acme', user: { id: 'u1' } }, { headers: {} }, res, 'documentos',
    { id: 'doc_1', url: 'https://x.private.blob.vercel-storage.com/outra/documentos/2026/09/1_a.pdf' });
  assert.strictEqual(status, 403, 'U1: salvar documento com URL de outra empresa deve dar 403');
  assert.strictEqual(queries, 0, 'U1: nada pode ser gravado');

  const sync = read('api/_db-sync.js');
  assert(sync.includes("isTenantStorageUrl(doc.url, tenantId)"), 'U1: sync_all também valida');
  const upload = read('api/upload.js');
  const getBlock = upload.slice(upload.indexOf("if (req.method === 'GET')"), upload.indexOf("const isPrivate = blobUrl.includes"));
  assert(getBlock.includes('isTenantStorageUrl(blobUrl, tenantId)'), 'U1: link assinado valida o dono');
  assert(upload.includes('if (finalUrl && !isTenantStorageUrl(finalUrl, tenantId) && !auth.isSystem)'), 'U1: exclusão valida o dono mesmo com linha existente');
  const mut = read('api/_db-mutations.js');
  assert(mut.includes("includes('blob.vercel-storage.com') && isTenantStorageUrl(rows[0].url, tenantId)"), 'U1: exclusão via /api/db valida o dono');
  console.log('  ✓ U1 documentos só referenciam arquivos da própria empresa');
}

// U2/U3 — Assinaturas: rótulo do aparelho visível; data retroativa recusada; horário do servidor exposto.
{
  const src = read('api/assinaturas.js');
  assert(src.includes('if (!looksLikeIp) return raw;'), 'U2: rótulo de aparelho não é mascarado');
  assert(src.includes('24 * 60 * 60 * 1000'), 'U3: limite de diferença de horário');
  assert(src.includes('registrado_em: r.created_at'), 'U3: validação pública expõe horário do servidor');
  for (const f of ['js/validar_page.js', 'frontend/domains/contratos/validar_page.js']) {
    assert(read(f).includes('Registrado na base FinGo em:'), `U3: ${f} mostra o horário do servidor`);
  }
  console.log('  ✓ U2/U3 assinatura com aparelho legível e data limitada ao horário do servidor');
}

// U4 — Login confere a senha antes de revelar status da conta/empresa; inexistente paga o scrypt.
{
  const src = read('api/auth.js');
  const login = src.slice(src.indexOf("action === 'login'"), src.indexOf('// PATCH 49'));
  const pw = login.indexOf('verifyPassword(password, user.senha_hash)');
  for (const motivo of ['user_inactive', 'tenant_blocked', 'tenant_canceled', 'trial_expired']) {
    assert(pw > 0 && pw < login.indexOf(motivo), `U4: senha antes de ${motivo}`);
  }
  assert.strictEqual(login.split('await burnPasswordCheck(password);').length - 1, 3, 'U4: tenant/usuário inexistente pagam o scrypt');
  console.log('  ✓ U4 login não revela existência/status da conta sem a senha');
}

// U5 — Google: chave inexistente e conta não vinculada têm a mesma resposta.
{
  const src = read('api/auth.js');
  const g = src.slice(src.indexOf("action === 'google'"), src.indexOf("action === 'sessions'"));
  assert(!g.includes('Chave da Empresa não encontrada'), 'U5: sem mensagem específica de chave inexistente');
  assert.strictEqual(g.split('return googleNotLinked();').length - 1, 2, 'U5: resposta única nos dois casos');
  console.log('  ✓ U5 login Google não revela quais chaves de empresa existem');
}

console.log('\n✅ Auditoria 2026-10-02 (4ª rodada): todas as regressões passaram.');
