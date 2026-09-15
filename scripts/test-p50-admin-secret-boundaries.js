// scripts/test-p50-admin-secret-boundaries.js
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const root = process.cwd();
const admin = fs.readFileSync(path.join(root, 'api/admin.js'), 'utf8');
const internalAdmin = fs.readFileSync(path.join(root, 'api/_admin-route.js'), 'utf8');

assert(admin.includes("import originalAdminHandler from './_admin-route.js'"), 'admin.js deve delegar rotas não sensíveis ao handler histórico interno.');
assert(admin.includes('getSessionSigningSecret'), 'admin.js deve usar SESSION_SIGNING_SECRET para impersonação/restauração.');
assert(admin.includes('getInternalApiSecret'), 'admin.js deve usar INTERNAL_API_SECRET para comunicação Vercel→Render.');
assert(!admin.includes('process.env.API_SECRET'), 'admin.js público não pode consultar API_SECRET legado.');
assert(!admin.includes('process.env.VERCEL_API_SECRET'), 'admin.js público não pode consultar VERCEL_API_SECRET legado.');

assert(admin.includes("action === 'impersonate'"), 'wrapper deve interceptar impersonate antes do handler legado.');
assert(admin.includes("action === 'restore_master_session'"), 'wrapper deve interceptar restore_master_session antes do handler legado.');
assert(admin.includes("action === 'send_billing_notice'"), 'wrapper deve interceptar cobrança com WhatsApp.');
assert(admin.includes("action === 'trigger_billing_sweep'"), 'wrapper deve interceptar varredura de cobrança.');
assert(admin.includes("action === 'generate_tenant_access_key'"), 'wrapper deve encaminhar geração de chave ao cofre DEV.');
assert(admin.includes("action === 'rotate_tenant_access_key'"), 'wrapper deve encaminhar rotação de chave ao cofre DEV.');

assert(admin.includes("'x-tenant-id': tenantId"), 'WhatsApp de cobrança deve usar o tenant real, nunca um tenant hardcoded.');
assert(!admin.includes("'x-tenant-id': 'angelim'"), 'admin.js público não pode fixar tenant angelim para cobrança multi-tenant.');
assert(admin.includes('mfa_verified: true'), 'tokens de impersonação/restauração devem preservar MFA verificado.');
assert(admin.indexOf("action === 'impersonate'") < admin.lastIndexOf('return originalAdminHandler(req, res)'), 'impersonate deve ser interceptado antes da delegação.');

// O handler histórico permanece somente como helper interno; referências legadas nele não ficam diretamente roteáveis.
assert(internalAdmin.includes('export default async function handler'), '_admin-route.js deve preservar o handler histórico para rotas não sensíveis.');

console.log('✅ P50 admin secret boundaries: verificações estáticas passaram.');
