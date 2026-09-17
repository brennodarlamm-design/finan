---
name: vercel-deployment-security
description: Review Vercel project configuration, environment variables, preview deployments, functions, routing, caching, domains, logs, and deployment access for security risks. Use for Vercel-hosted applications; verify current platform behavior from official documentation when configuration depends on recent features.
---

# Vercel Deployment Security

Review the deployed boundary as well as repository configuration.

## Map deployment behavior

Identify production, preview, and development environments; linked projects; domains; functions; edge or middleware logic; cron jobs; build commands; output directories; storage integrations; and CI identities. Determine which branches and contributors can create deployments.

## Review controls

- Environment variables are correctly scoped, not exposed through public prefixes, logs, build output, or preview deployments.
- Preview deployments containing real data or privileged APIs require appropriate access controls.
- Deployment tokens, integration credentials, and CI permissions are least-privileged and rotated when exposed.
- Functions authenticate and authorize independently of route visibility.
- Rewrites, redirects, middleware, and proxy routes cannot bypass authorization or create open redirects/SSRF.
- Cache rules do not store personalized or authenticated responses under shared keys.
- Sensitive responses have suitable cache controls; tenant/user identity contributes to cache variation when needed.
- Source maps, debug pages, logs, and observability exports do not expose secrets or personal data.
- Custom domains, DNS, redirects, and abandoned deployments do not create takeover or origin-bypass paths.
- Cron endpoints authenticate the scheduler and resist replay where side effects matter.

## Operational safety

Use read-only inspection by default. Do not change environment variables, promote/rollback deployments, alter domains, or invalidate production caches unless explicitly requested. Treat live platform settings as time-sensitive and consult official Vercel documentation when exact behavior matters.

## Output

Separate repository findings from live project settings and from unknowns. Each finding includes environment, route/service, evidence, impact, remediation, and verification. Call out differences among production and preview that materially change risk.
