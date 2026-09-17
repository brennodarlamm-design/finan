---
name: auth-iam-review
description: Review authentication, sessions, account recovery, role and tenant authorization, service identities, and privileged administration. Use for login or IAM flows; do not use for unrelated cryptography or generic code review.
---

# Authentication and IAM Review

Trace identity from credential proof to every privileged decision.

## Map identities and privileges

List user roles, tenant memberships, administrators, support impersonation, service accounts, API keys, background workers, and deployment identities. Identify who can grant roles, reset access, export data, change billing, or act across tenants.

## Review authentication

- Password storage uses a suitable adaptive password hash and unique salts.
- Login resists enumeration, brute force, credential stuffing, and unsafe verbose errors.
- MFA, if present, has protected enrollment, recovery, and step-up flows.
- Email verification, password reset, magic links, and invitations are single-use, time-bound, audience-bound, and invalidate safely.
- OAuth/OIDC validates issuer, audience, signature, state, nonce, PKCE, and exact redirect policy.
- Session identifiers are unpredictable, rotated after privilege changes, revoked on logout/reset, and protected in transit and storage.

## Review authorization

- Deny by default and enforce decisions server-side.
- Check both action permission and resource ownership/tenant membership.
- Derive tenant context from trusted membership, not a caller-supplied tenant ID alone.
- Prevent horizontal and vertical privilege escalation.
- Protect role changes, support tools, impersonation, audit-log access, and bulk export with stronger controls and audit trails.
- Use least privilege for service roles and separate runtime from migration/admin credentials.

## Abuse cases

Test logically for invitation hijack, reset replay, stale membership, deleted-user sessions, role downgrade persistence, multi-tab logout, email change takeover, organization switching, confused deputy behavior, and missing re-authentication for critical actions.

## Output

Provide an identity/role matrix, trust-boundary summary, confirmed findings, and safe remediation order. Evidence must identify the policy, enforcement point, and bypass path. Do not expose credentials or attempt access to accounts without explicit authorization.
