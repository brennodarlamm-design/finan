import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const tests = [
  'scripts/test-startup-behavior.js',
  'scripts/test-assets-behavior.js',
  'scripts/test-audit-regressions.js',
  'scripts/test-sinapi-official.js',
  'scripts/test-sync-behavior.js',
  'scripts/test-hardening-static.js',
  'scripts/test-patch02-static.js',
  'scripts/test-patch03-static.js',
  'scripts/test-patch04-static.js',
  'scripts/test-patch05-static.js',
  'scripts/test-patch06-static.js',
  'scripts/test-patch07-static.js',
  'scripts/test-patch08-static.js',
  'scripts/test-patch09-static.js',
  'scripts/test-patch10-static.js',
  'scripts/test-patch11-static.js',
  'scripts/test-patch12-static.js',
  'scripts/test-patch13-static.js',
  'scripts/test-patch14-static.js',
  'scripts/test-patch15-static.js',
  'scripts/test-patch16-static.js',
  'scripts/test-patch17-static.js',
  'scripts/test-patch18-static.js',
  'scripts/test-patch19-static.js',
  'scripts/test-patch20-static.js',
  'scripts/test-patch21-static.js',
  'scripts/test-finbot-learning-static.js',
  'scripts/test-patch22-static.js',
  'scripts/test-patch23-static.js',
  'scripts/test-patch24-static.js',
  'scripts/test-patch25-static.js',
  'scripts/test-patch26-static.js',
  'scripts/test-patch26-hotfix-static.js',
  'scripts/test-patch27-static.js',
  'scripts/test-patch28-static.js',
  'scripts/test-patch29-static.js',
  'scripts/test-patch30-static.js',
  'scripts/test-patch31-static.js',
  'scripts/test-patch32-static.js',
  'scripts/test-patch33-static.js',
  'scripts/test-patch34-static.js',
  'scripts/test-patch35-static.js',
  'scripts/test-patch36-static.js',
  'scripts/test-patch37-static.js',
  'scripts/test-patch37-block2-static.js',
  'scripts/test-patch37-block3-static.js',
  'scripts/test-patch37-release-hardening-static.js',
  'scripts/test-patch38-static.js',
  'scripts/test-monitor-nfe-static.js',
  'scripts/test-patch39-static.js',
  'scripts/test-patch40-static.js',
  'scripts/test-patch41-static.js',
  'scripts/test-patch42-static.js',
  'scripts/test-patch43-static.js',
  'scripts/test-patch44-static.js',
  'scripts/test-patch45-static.js',
  'scripts/test-patch46-static.js',
  'scripts/test-patch47-static.js',
  'scripts/test-patch48-static.js',
  'scripts/test-patch49-static.js',
  'scripts/test-patch50-security.js',
  'scripts/test-p50-dev-key-vault.js',
  'scripts/test-p50-admin-secret-boundaries.js',
  'scripts/test-patch51-static.js',
  'scripts/test-patch51-workflow-integration.js',
  'scripts/test-patch52-static.js',
  'scripts/test-patch53-static.js',
  'scripts/test-master-improvement.js',
  'scripts/test-segmentation-agenda.js',
  'scripts/test-sync-optimization.js',
  'scripts/test-storage-reliability.js',
  'scripts/test-trigger-integration.js',
  'scripts/test-backend-architecture.js',
  'scripts/test-security-governance.js',
  'scripts/test-patch55-security.js',
  'scripts/test-patch56-security.js',
  'scripts/test-patch56-tenant-context.js',
  'scripts/test-phase2-reliability.js',
  'scripts/test-phase3-ergonomics.js',
  'scripts/test-seo-indexing.js',
  'scripts/test-phase4-design-system.js',
  'scripts/test-snapshot-payload.js',
  'scripts/test-finbot-key-pool.js',
  'scripts/test-bug-hunter-fixes.js',
  'scripts/test-edge-security-design.js',
  'scripts/test-edge-v2-routes.js',
  'scripts/test-bug-hunter-reaudit-fixes.js',
  'scripts/test-cloudflare-workers-full.js',
  'scripts/test-edge-security-monitoring.js',
  'scripts/test-legal-cookie-banner.js',
  'scripts/test-evolutionary-pillars.js',
  'scripts/test-bim-viewer-work-pr.js'
].filter(fs.existsSync);

const p50NativeSourceTests = new Set([
  'scripts/test-patch50-security.js',
  'scripts/test-p50-dev-key-vault.js',
  'scripts/test-p50-admin-secret-boundaries.js',
  'scripts/test-patch51-static.js',
  'scripts/test-patch51-workflow-integration.js',
  'scripts/test-backend-architecture.js',
  'scripts/test-security-governance.js',
  'scripts/test-patch55-security.js',
  'scripts/test-patch56-security.js',
  'scripts/test-patch56-tenant-context.js',
  'scripts/test-phase2-reliability.js',
  'scripts/test-phase3-ergonomics.js',
  'scripts/test-seo-indexing.js',
  'scripts/test-phase4-design-system.js',
  'scripts/test-snapshot-payload.js',
  'scripts/test-finbot-key-pool.js',
  'scripts/test-bug-hunter-fixes.js',
  'scripts/test-edge-security-design.js',
  'scripts/test-edge-v2-routes.js',
  'scripts/test-bug-hunter-reaudit-fixes.js',
  'scripts/test-legal-cookie-banner.js',
  'scripts/test-evolutionary-pillars.js'
]);
const preload = path.resolve('scripts/test-api-wrapper-preload.cjs');

for (const file of tests) {
  console.log(`\n=== ${file} ===`);
  const env = { ...process.env };

  // Patch 56: a suíte nunca depende de segredos hardcoded da aplicação.
  // Estes valores são exclusivos do processo de teste e não são usados em produção.
  env.SESSION_SIGNING_SECRET ||= 'test-only-session-signing-secret-0123456789abcdef';
  env.MFA_ENCRYPTION_KEY ||= 'test-only-mfa-encryption-key-0123456789abcdef';
  env.TENANT_KEY_PEPPER ||= 'test-only-tenant-key-pepper-0123456789abcdef';
  env.IP_BAN_PEPPER ||= 'test-only-ip-ban-pepper-0123456789abcdef';

  if (!p50NativeSourceTests.has(file)) {
    const prior = String(env.NODE_OPTIONS || '').trim();
    env.NODE_OPTIONS = `${prior}${prior ? ' ' : ''}--require=${preload}`;
  }
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('\n✅ Todas as verificações estáticas e de integração passaram.');
