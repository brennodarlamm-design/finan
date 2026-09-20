# FinGo — Backup, restore and rollback runbook

## Production database

Neon point-in-time history is limited by the current project plan to 6 hours. The repository therefore keeps a second recovery path using a daily logical `pg_dump` artifact with 30-day retention.

Required GitHub Actions secret:

- `DATABASE_URL_UNPOOLED`: direct Neon connection string for the production database. Do not use a pooled connection for `pg_dump`.

Manual backup: Actions → **FinGo production database backup** → Run workflow.

Restore rehearsal:

1. Download the latest `.dump` artifact.
2. Create an isolated Neon branch/database.
3. Run `pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" backup.dump`.
4. Run the application regression and tenant-isolation tests against the restored database.
5. Never restore directly over production before validating the isolated restore.

A manual Neon snapshot named `pre-launch-hardening-2026-09-20` was created before this hardening work and expires on 2026-10-20.

## Cloudflare Worker rollback

Actions → **FinGo Cloudflare rollback** → provide a reason and optionally a Worker Version ID.

If the Version ID is omitted, Wrangler rolls back to the version immediately before the current deployment. The workflow performs a production health check after the rollback.

Database migrations are not rolled back by a Worker rollback. Any release that changes persistent data must include a forward-compatible migration and a separate database recovery plan.
