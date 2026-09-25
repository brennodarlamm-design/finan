# FinGo Security Policy & Governance

This repository adheres to strict security standards, defense-in-depth architecture, and fail-closed policies.

## Complete Security Architecture & Audit Map

For the complete technical breakdown of system security, IAM, multi-tenancy, cryptography, edge defenses, and incident response, please refer to:

👉 **[FinGo Complete Security Architecture & End-to-End Mapping](docs/security/README.md)**

---

## Core Security Invariants

1. **Commit Before Deploy:** Tests must pass, semantic git commit created, and pushed to remote BEFORE any production build or deployment (`npm run build:cloudflare && npm run deploy:cloudflare`).
2. **Cloudflare Pages Exclusive:** Vercel is banned as a production deployment target. Cloudflare Pages is the sole authorized production host.
3. **Tenant Isolation:** Every PostgreSQL query and mutation must enforce `tenant_id` resolved online from authenticated session, reinforced by PostgreSQL `FORCE ROW LEVEL SECURITY`.
4. **Strict CSP:** No inline DOM event handlers allowed (`script-src-attr 'none'`); interactions use declarative bus `data-fb-*`.
5. **Fail-Closed RBAC:** Unmapped tables or actions reject by default. Custom permissions can only restrict access, never elevate privileges.
6. **Timing Attack Resistance:** Secret and token comparisons use `crypto.timingSafeEqual`.

---

## Reporting Vulnerabilities

If you discover a security issue or vulnerability, do not open a public issue. Report it immediately to the security operations team via the dedicated secure channel.
