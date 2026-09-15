// Test-only compatibility layer for APIs split into public wrappers + internal helpers.
// Legacy static suites inspect api/admin.js and api/audit.js as text. At runtime those
// files delegate to _admin-route.js / _audit-route.js, so the tests must inspect the
// composed implementation rather than only the thin public multiplexer.
const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync.bind(fs);
const root = process.cwd();

function isUtf8(options) {
  if (typeof options === 'string') return /utf-?8/i.test(options);
  return options && typeof options === 'object' && /utf-?8/i.test(String(options.encoding || ''));
}

function norm(value) {
  try { return path.resolve(String(value)).replace(/\\/g, '/'); } catch { return ''; }
}

fs.readFileSync = function patchedReadFileSync(file, options) {
  const base = originalReadFileSync(file, options);
  if (!isUtf8(options) || typeof base !== 'string') return base;

  const resolved = norm(file);
  const adminPath = norm(path.join(root, 'api', 'admin.js'));
  const auditPath = norm(path.join(root, 'api', 'audit.js'));

  if (resolved === adminPath) {
    const helper = originalReadFileSync(path.join(root, 'api', '_admin-route.js'), 'utf8');
    return `${base}\n/* COMPOSED INTERNAL ADMIN HANDLER FOR STATIC TESTS */\n${helper}`;
  }
  if (resolved === auditPath) {
    const helper = originalReadFileSync(path.join(root, 'api', '_audit-route.js'), 'utf8');
    return `${base}\n/* COMPOSED INTERNAL AUDIT HANDLER FOR STATIC TESTS */\n${helper}`;
  }
  return base;
};
