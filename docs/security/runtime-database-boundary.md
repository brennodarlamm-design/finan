# Runtime Database Boundary

## Objective

FinGo uses two explicit Neon connection boundaries:

- `DATABASE_URL`: tenant runtime only. It must connect with the least-privilege `finobra_app` role (LOGIN, NOBYPASSRLS).
- `DATABASE_OWNER_URL`: privileged bootstrap/admin/payment operations only. It must never be used as the tenant runtime fallback.

## Required production state

Before deploying this hardening:

1. Keep migrations `031_strict_rls_least_privilege.sql` and `032_rls_public_validation_and_audit.sql` applied.
2. Confirm all tenant tables have RLS and FORCE RLS enabled.
3. Configure `DATABASE_URL` with the `finobra_app` connection string.
4. Configure `DATABASE_OWNER_URL` separately with the owner connection string.
5. Do not copy either connection string into frontend assets, browser storage, logs, or public environment variables.

## Runtime behavior

`api/_database.js` rejects a `DATABASE_URL` whose username is an owner role. Tenant queries then use `createTenantSql()`, which sets only the transaction-local `app.current_tenant_id`.

There is no `app.is_system` bypass in the tenant wrapper. Cross-tenant operations must be implemented only in explicitly privileged server-side routes using `DATABASE_OWNER_URL`.

## Validation

The regression suite must fail if:

- `app.is_system` returns to `api/_tenant-sql.js`;
- auth/admin/payment code falls back from `DATABASE_OWNER_URL` to `DATABASE_URL`;
- the runtime boundary stops rejecting owner roles.
