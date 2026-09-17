---
name: postgres-rls-security
description: Review PostgreSQL and Supabase schemas, roles, grants, row-level security, functions, migrations, and tenant isolation. Use for database authorization and exposure review; do not execute destructive SQL or production migrations without explicit authorization.
---

# PostgreSQL and RLS Security

Prove tenant isolation at the database boundary where RLS is part of the design.

## Inventory

Map schemas, exposed tables/views, roles, grants, RLS status, policies, functions, triggers, storage objects, connection identities, migration users, and application query paths. Determine which clients connect directly and which use a server/service role.

## RLS review

- Enable RLS on exposed tenant or user data and consider forced RLS where table owners could otherwise bypass it.
- Review every operation separately: `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- Check both `USING` and `WITH CHECK`; an update policy that filters old rows may still allow unsafe new values.
- Base tenant membership on trusted identity claims or membership tables, not a caller-supplied tenant identifier.
- Test nulls, missing memberships, role changes, soft deletes, joins, views, and indirect access through functions.
- Ensure service-role or bypass-RLS credentials never reach the browser.

## PostgreSQL privilege review

- Revoke unnecessary default/public privileges and use least-privileged runtime roles.
- Separate migration, owner, maintenance, and application roles.
- Parameterize application queries and constrain dynamic identifiers with allowlists.
- Review `SECURITY DEFINER` functions for fixed safe `search_path`, minimal owner rights, input validation, and explicit execution grants.
- Inspect views, materialized views, extensions, trigger functions, and storage policies for privilege bypass.
- Protect backups, connection strings, audit logs, and database admin endpoints.

## Verification

Prefer transaction-wrapped tests with synthetic users from two tenants plus anonymous, ordinary, admin, and service contexts. Verify allowed and denied operations without using production data. Roll back tests unless persistent fixtures were requested.

## Output

Provide a table/operation policy matrix, role/grant summary, confirmed isolation failures, and safe migration guidance. Include exact SQL object names and migration files, but redact credentials. Clearly label behavior that was inferred because live database metadata was unavailable.
