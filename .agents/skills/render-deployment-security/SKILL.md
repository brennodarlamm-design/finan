---
name: render-deployment-security
description: Review Render Blueprints and services for secret handling, network exposure, runtime identity, health checks, disks, databases, deploy hooks, logs, and least privilege. Use for Render-hosted systems; verify current platform behavior from official documentation when recent features matter.
---

# Render Deployment Security

Assess `render.yaml`, Docker/runtime settings, and live service configuration without modifying production by default.

## Inventory

Map web services, private services, background workers, cron jobs, static sites, databases, key-value stores, disks, environment groups, build/deploy commands, health checks, regions, and public/private connections. Identify which repositories, branches, and deploy hooks can publish changes.

## Review controls

- Secrets use secret environment values or groups and do not appear in Blueprints, images, logs, or static builds.
- Services that need no internet ingress are private; public services expose only intended ports and routes.
- Applications bind to the platform-provided port and do not expose auxiliary admin/debug listeners.
- Internal database and service addresses are used where appropriate; public database access is restricted.
- Runtime users and database roles have least privilege; migration credentials are separated.
- Deploy hooks, API keys, repository connections, and CI identities are protected and narrowly scoped.
- Health checks reveal minimal information and do not perform state-changing work.
- Persistent disks do not store secrets or sensitive files without suitable protection, backup, and single-instance constraints.
- Build and start commands avoid shell injection, remote bootstrap scripts, and unsafe debug flags.
- Logs and metrics redact tokens, connection strings, session data, and personal information.

## Safety and output

Use read-only inspection unless the user asks for a change. Do not redeploy, restart, resize, alter environment variables, or open network access during an audit. Verify time-sensitive behavior with official Render documentation.

Report findings by service and environment, with source (`render.yaml` or live setting), evidence, impact, remediation, and validation. Distinguish Blueprint drift from a vulnerable setting.
