# FinGo — Backup, restore and rollback runbook

## Production database

Neon point-in-time history is limited by the current project plan to 6 hours. The repository therefore keeps a second recovery path using a daily logical `pg_dump` with 30-day retention.

The database dump is never uploaded to GitHub Actions in plaintext. The workflow validates the dump, packages its manifest and checksum, encrypts the bundle with AES-256-CBC + PBKDF2, verifies a full decrypt/read round-trip, removes plaintext material, and only then uploads the encrypted artifact.

Required GitHub Actions secrets:

- `DATABASE_URL_UNPOOLED`: direct Neon connection string for the production database. Do not use a pooled connection for `pg_dump`.
- `BACKUP_ENCRYPTION_PASSPHRASE`: dedicated backup passphrase with at least 24 characters. Keep it outside the repository and separate from application/runtime secrets.

Manual backup: Actions → **FinGo production database backup** → Run workflow.

Restore rehearsal:

1. Download the latest `.tar.gz.enc` artifact and its `.sha256`.
2. Verify the encrypted file checksum with `sha256sum -c <arquivo>.sha256`.
3. Decrypt it with:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in <arquivo>.tar.gz.enc -out backup.tar.gz -pass env:BACKUP_ENCRYPTION_PASSPHRASE`.
4. Extract `backup.tar.gz` into a temporary directory.
5. Verify the included plaintext dump checksum before restore.
6. Create an isolated Neon branch/database.
7. Run `pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" <arquivo>.dump`.
8. Run the application regression and tenant-isolation tests against the restored database.
9. Delete local decrypted backup material after the rehearsal.
10. Never restore directly over production before validating the isolated restore.

A manual Neon snapshot named `pre-launch-hardening-2026-09-20` was created before this hardening work and expires on 2026-10-20.

## Cloudflare Worker rollback

Actions → **FinGo Cloudflare rollback** → provide a reason and optionally a Worker Version ID.

If the Version ID is omitted, Wrangler rolls back to the version immediately before the current deployment. The workflow performs a production health check after the rollback.

Database migrations are not rolled back by a Worker rollback. Any release that changes persistent data must include a forward-compatible migration and a separate database recovery plan.
