---
name: api-security-review
description: Assess REST, GraphQL, RPC, and webhook implementations for authentication, authorization, validation, abuse, and data-exposure flaws. Use when reviewing API routes or contracts; do not use for general frontend-only review or unauthorized live probing.
---

# API Security Review

Review APIs from route inventory through business impact.

## Build the inventory

Enumerate public, authenticated, admin, internal, webhook, upload, export, and health endpoints from code and API schemas. Record method, handler, auth middleware, role/tenant checks, inputs, data returned, rate limits, and side effects.

## Test the control chain

For every sensitive route, verify:

1. Authentication is mandatory and correctly validates token or session state.
2. Authorization is performed on the server for the action and object.
3. Tenant ownership is included in database queries and cannot be selected by client input alone.
4. Input has type, size, format, and semantic limits before reaching a sink.
5. Output is explicitly selected and does not leak internal fields.
6. Expensive or sensitive actions have rate, quota, replay, and idempotency controls.

## Priority failure modes

- BOLA/IDOR, broken function-level authorization, and cross-tenant access.
- Excessive data exposure, mass assignment, and unsafe filtering/sorting fields.
- JWT mistakes: accepting wrong algorithms, issuers, audiences, stale tokens, or unverified claims.
- OAuth/OIDC mistakes involving redirect URIs, state, nonce, PKCE, scopes, and token placement.
- SSRF through URL import, preview, webhook, callback, or proxy features.
- Injection into databases, shells, templates, search engines, and downstream APIs.
- GraphQL introspection exposure, missing resolver authorization, alias/depth/cost abuse.
- Webhook forgery, replay, wrong raw-body verification, and secret comparison weaknesses.
- Unbounded pagination, file size, batch operations, exports, and resource consumption.
- CORS that reflects arbitrary origins or permits credentialed untrusted origins.

## Validation

Prefer code-path evidence and unit/integration tests. For live calls, use `$authorized-web-pentest` and obtain scope before testing. Use synthetic identifiers and minimum data. Never access another real tenant's records.

## Output

Provide an endpoint risk table and confirmed findings with request preconditions, server-side evidence, impact, remediation, and a safe regression case. Distinguish missing documentation from missing enforcement. Include endpoints not reviewed and assumptions about gateways or middleware.
