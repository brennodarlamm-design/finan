// scripts/security-preflight.js
// Patch 56 — diagnóstico READ-ONLY do hardening de produção.
// Não altera dados, roles, policies ou schema.
// Uso: node scripts/security-preflight.js [--strict]

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const strict = process.argv.includes('--strict');
const runtimeConn = String(process.env.DATABASE_URL || '').trim();
const ownerConn = String(process.env.DATABASE_OWNER_URL || '').trim();
if (!runtimeConn) {
  console.error('DATABASE_URL runtime não configurada.');
  process.exit(1);
}
if (!ownerConn) {
  console.error('DATABASE_OWNER_URL privilegiada não configurada.');
  process.exit(1);
}

const secretChecks = {
  MFA_ENCRYPTION_KEY: String(process.env.MFA_ENCRYPTION_KEY || '').length >= 32,
  TENANT_KEY_PEPPER: String(process.env.TENANT_KEY_PEPPER || '').length >= 32,
  IP_BAN_PEPPER: String(process.env.IP_BAN_PEPPER || '').length >= 32,
  SESSION_SIGNING_SECRET: String(process.env.SESSION_SIGNING_SECRET || '').length >= 32,
  INTERNAL_API_SECRET: String(process.env.INTERNAL_API_SECRET || '').length >= 32,
  PIX_WEBHOOK_SECRET: String(process.env.PIX_WEBHOOK_SECRET || '').length >= 24
};

const runtimeSql = neon(runtimeConn);
const ownerSql = neon(ownerConn);

const [identity] = await runtimeSql`;
  SELECT current_user AS current_user,
         current_setting('app.current_tenant_id', true) AS tenant_context,
         current_setting('app.is_system', true) AS system_context;
`;

const [rls] = await ownerSql`
  SELECT
    COUNT(*)::int AS tenant_tables,
    COUNT(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
    COUNT(*) FILTER (WHERE c.relforcerowsecurity)::int AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attname = 'tenant_id'
    AND a.attnum > 0
    AND NOT a.attisdropped;
`;

const roles = await ownerSql`
  SELECT rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb
  FROM pg_roles
  WHERE rolname IN ('finobra_app', 'neondb_owner')
  ORDER BY rolname;
`;

const [mfa] = await ownerSql`
  SELECT
    COUNT(*) FILTER (WHERE perfil = 'superadmin' AND mfa_enabled = TRUE AND mfa_secret IS NOT NULL)::int AS superadmins_mfa,
    COUNT(*) FILTER (WHERE perfil = 'superadmin' AND mfa_enabled = TRUE AND mfa_secret LIKE 'v1$%')::int AS encrypted_mfa,
    COUNT(*) FILTER (WHERE perfil = 'superadmin' AND mfa_enabled = TRUE AND mfa_secret IS NOT NULL AND mfa_secret NOT LIKE 'v1$%')::int AS legacy_mfa
  FROM usuarios;
`;

const [securityTables] = await ownerSql`
  SELECT
    to_regclass('public.security_ip_state') IS NOT NULL AS security_ip_state,
    to_regclass('public.security_ip_events') IS NOT NULL AS security_ip_events,
    to_regclass('public.security_ip_allowlist') IS NOT NULL AS security_ip_allowlist;
`;

const [dataApiGrants] = await ownerSql`
  SELECT COUNT(*)::int AS public_table_grants
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('authenticated', 'anonymous');
`;

const appRole = roles.find(r => r.rolname === 'finobra_app');
const ownerRole = roles.find(r => r.rolname === 'neondb_owner');

const report = {
  runtime: {
    currentUser: identity?.current_user || null,
    tenantContext: identity?.tenant_context || null,
    systemContext: identity?.system_context || null
  },
  secrets: Object.fromEntries(Object.entries(secretChecks).map(([k, ok]) => [k, ok ? 'configured' : 'missing_or_weak'])),
  rls: {
    tenantTables: Number(rls?.tenant_tables || 0),
    enabled: Number(rls?.rls_enabled || 0),
    forced: Number(rls?.rls_forced || 0)
  },
  roles: {
    finobraAppExists: Boolean(appRole),
    finobraAppBypassRls: Boolean(appRole?.rolbypassrls),
    ownerBypassRls: Boolean(ownerRole?.rolbypassrls)
  },
  mfa: {
    superadmins: Number(mfa?.superadmins_mfa || 0),
    encrypted: Number(mfa?.encrypted_mfa || 0),
    legacy: Number(mfa?.legacy_mfa || 0)
  },
  ipDefenseTables: securityTables,
  dataApiPublicGrants: Number(dataApiGrants?.public_table_grants || 0)
};

console.log(JSON.stringify(report, null, 2));

const blockers = [];
for (const [name, ok] of Object.entries(secretChecks)) {
  if (!ok) blockers.push(`${name}: ausente/fraco`);
}
if (!securityTables?.security_ip_state || !securityTables?.security_ip_events || !securityTables?.security_ip_allowlist) {
  blockers.push('migration 030 ainda não aplicada');
}
if (Number(mfa?.legacy_mfa || 0) > 0) blockers.push('MFA legado em texto puro ainda existe');
if (!appRole) blockers.push('role finobra_app ainda não existe');
if (Number(rls?.rls_forced || 0) < Number(rls?.tenant_tables || 0)) blockers.push('FORCE RLS ainda não está completo');
if (identity?.current_user === 'neondb_owner') blockers.push('runtime ainda usa neondb_owner');
if (Number(dataApiGrants?.public_table_grants || 0) > 0) blockers.push('authenticated/anonymous ainda possuem grants em public');

console.log('\nBlockers de hardening:');
if (!blockers.length) console.log('- nenhum blocker detectado');
else blockers.forEach(item => console.log(`- ${item}`));

if (strict && blockers.length) process.exit(2);
