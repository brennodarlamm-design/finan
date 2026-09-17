---
name: secrets-exposure-audit
description: Detect and triage exposed credentials, tokens, private keys, connection strings, and sensitive configuration in source, history, build output, logs, and deployment files. Use for secret scanning and incident triage; do not reveal secret values or rotate them without authorization.
---

# Secrets Exposure Audit

Find exposure without spreading sensitive values.

## Scope

Inspect tracked files, untracked configuration when authorized, examples, fixtures, CI files, Docker build context, deployment manifests, client bundles, source maps, logs, documentation, and relevant version-control history. Distinguish public identifiers from authentication secrets.

## Safe workflow

1. Identify technologies and expected secret types without printing environment contents.
2. Use existing repository scanners when available. Prefer metadata-only output or redact values immediately.
3. Search for high-signal assignments and credential formats, then validate context manually.
4. Determine whether the value is real, reachable in deployed artifacts, committed to history, logged, or only a placeholder.
5. Classify blast radius: provider, permissions, environment, tenant/data access, and exposure duration.

Never echo, copy, commit, or include a complete secret in a report. Show a redacted fingerprint only when needed, such as the first and last two characters. Avoid commands that dump all environment variables.

## Common exposure paths

- `.env` files, shell history, IDE settings, CI logs, support bundles, and screenshots.
- `VITE_`, `NEXT_PUBLIC_`, or other client-exposed environment variables.
- Database service-role credentials, JWT signing keys, webhook secrets, cloud API tokens, SMTP keys, and private keys.
- Docker layers, package registry config, build cache, static assets, and source maps.
- Git history after a file was deleted from the current tree.

## Response guidance

For a confirmed live secret, recommend revocation or rotation before repository cleanup, then update dependents, inspect provider audit logs, invalidate sessions when relevant, and remove the secret from active artifacts. History rewriting is a separate, potentially disruptive decision and does not replace rotation.

## Output

Report secret type, redacted fingerprint, exact location, exposure channel, likely validity, privilege/blast radius, and remediation status. Separate confirmed exposures from examples and false positives. If compromise is plausible, clearly mark incident-response steps without taking external action unless requested.
